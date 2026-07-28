import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { libraryIdFor, normaliseMealText } from '@/features/meals/utils/mealText'
import type {
  MealDayTemplate,
  Template,
  TemplateCreatedFrom,
  TemplateKind,
  TemplatePayload,
  TemplateScope,
} from '@/features/templates/types/templateTypes'
import type { MealLibraryItem } from '@/features/meals/types/mealTypes'
import { baseApi, type ApiError } from './baseApi'

function toApiError(error: unknown): { error: ApiError } {
  const firebaseError = error as { code?: string; message?: string }
  return {
    error: {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? 'Something went wrong. Please try again.',
    },
  }
}

function requireUid(): string {
  const user = auth.currentUser
  if (!user) {
    throw Object.assign(new Error('Sign in first.'), { code: 'unauthenticated' })
  }
  return user.uid
}

function templateCollection(scope: TemplateScope, ownerId: string) {
  return scope === 'team'
    ? collection(db, 'teams', ownerId, 'templates')
    : collection(db, 'users', ownerId, 'templates')
}

function toTemplate(
  id: string,
  scope: TemplateScope,
  data: Record<string, unknown>,
): Template {
  return {
    id,
    kind: data.kind as TemplateKind,
    name: (data.name as string) ?? '',
    payload: (data.payload as TemplatePayload) ?? { items: [] },
    useCount: (data.useCount as number) ?? 0,
    createdFrom: (data.createdFrom as Template['createdFrom']) ?? 'manual',
    scope,
  }
}

function streamTemplates(
  scope: TemplateScope,
  ownerId: string,
  update: (templates: Template[]) => void,
) {
  return onSnapshot(templateCollection(scope, ownerId), (snap) => {
    update(
      snap.docs
        .map((docSnap) => toTemplate(docSnap.id, scope, docSnap.data()))
        .sort((a, b) => b.useCount - a.useCount),
    )
  })
}

export const templateApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPersonalTemplates: builder.query<Template[], string>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        uid,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = streamTemplates('personal', uid, (templates) =>
          updateCachedData(() => templates),
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['Templates'],
    }),

    getTeamTemplates: builder.query<Template[], string>({
      queryFn: async () => ({ data: [] }),
      async onCacheEntryAdded(
        teamId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) {
        try {
          await cacheDataLoaded
        } catch {
          return
        }
        const unsubscribe = streamTemplates('team', teamId, (templates) =>
          updateCachedData(() => templates),
        )
        await cacheEntryRemoved
        unsubscribe()
      },
      providesTags: ['TeamTemplates'],
    }),

    addTemplate: builder.mutation<
      { templateId: string },
      {
        scope: TemplateScope
        ownerId: string // uid for personal, teamId for team
        kind: TemplateKind
        name: string
        payload: TemplatePayload
        createdFrom: TemplateCreatedFrom
      }
    >({
      queryFn: async ({ scope, ownerId, kind, name, payload, createdFrom }) => {
        try {
          const ref = doc(templateCollection(scope, ownerId))
          await setDoc(ref, {
            kind,
            name: name.trim(),
            payload,
            useCount: 0,
            createdFrom,
            createdAt: serverTimestamp(),
          })
          return { data: { templateId: ref.id } }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    deleteTemplate: builder.mutation<
      void,
      { scope: TemplateScope; ownerId: string; templateId: string }
    >({
      queryFn: async ({ scope, ownerId, templateId }) => {
        try {
          await deleteDoc(doc(templateCollection(scope, ownerId), templateId))
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    bumpTemplateUse: builder.mutation<
      void,
      { scope: TemplateScope; ownerId: string; templateId: string }
    >({
      queryFn: async ({ scope, ownerId, templateId }) => {
        try {
          await setDoc(
            doc(templateCollection(scope, ownerId), templateId),
            { useCount: increment(1) },
            { merge: true },
          )
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),

    // R12.2: staging — one batch of draft meal docs for the date. Drafts
    // don't bump library counters (that happens on confirm); unknown texts
    // get their library doc created now so confirm has something to bump.
    applyMealDayTemplate: builder.mutation<
      void,
      { date: string; template: MealDayTemplate; library: MealLibraryItem[] }
    >({
      queryFn: async ({ date, template, library }) => {
        try {
          const uid = requireUid()
          const known = new Set(library.map((item) => item.id))
          const batch = writeBatch(db)
          const seenNew = new Set<string>()
          template.payload.items.forEach((item, index) => {
            const text = item.text.trim()
            const libraryRefId = item.libraryRefId ?? libraryIdFor(text)
            const mealRef = doc(collection(db, 'users', uid, 'meals'))
            batch.set(mealRef, {
              date,
              slot: item.slot,
              libraryRefId,
              textSnapshot: text,
              ...(item.tag ? { tag: item.tag } : {}),
              status: 'draft',
              // Staggered so the day view keeps the template's order.
              loggedAt: Timestamp.fromMillis(
                new Date(`${date}T06:00:00+10:00`).getTime() + index * 60_000,
              ),
              createdAt: serverTimestamp(),
            })
            if (!known.has(libraryRefId) && !seenNew.has(libraryRefId)) {
              seenNew.add(libraryRefId)
              batch.set(
                doc(db, 'users', uid, 'mealLibrary', libraryRefId),
                {
                  text,
                  normalisedText: normaliseMealText(text),
                  tag: item.tag ?? null,
                  useCount: increment(0),
                  lastUsedAt: serverTimestamp(),
                  favourite: false,
                  hidden: false,
                  createdAt: serverTimestamp(),
                },
                { merge: true },
              )
            }
          })
          await batch.commit()
          return { data: undefined }
        } catch (error) {
          return toApiError(error)
        }
      },
    }),
  }),
})

export const {
  useGetPersonalTemplatesQuery,
  useGetTeamTemplatesQuery,
  useAddTemplateMutation,
  useDeleteTemplateMutation,
  useBumpTemplateUseMutation,
  useApplyMealDayTemplateMutation,
} = templateApi
