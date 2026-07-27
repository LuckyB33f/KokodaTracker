import type { GeoPoint } from './geo'

// IndexedDB buffer for in-progress recordings (spec F4: a crash loses
// nothing). One well-known key; cleared on successful save or discard.
const DB_NAME = 'kokoda-recording'
const STORE = 'points'
const KEY = 'active'

interface BufferedRecording {
  startedAtMs: number
  points: GeoPoint[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error as Error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error as Error)
    })
  } finally {
    db.close()
  }
}

export async function saveBuffer(recording: BufferedRecording): Promise<void> {
  await withStore('readwrite', (store) => store.put(recording, KEY))
}

export async function loadBuffer(): Promise<BufferedRecording | null> {
  const result = await withStore<BufferedRecording | undefined>(
    'readonly',
    (store) => store.get(KEY) as IDBRequest<BufferedRecording | undefined>,
  )
  return result ?? null
}

export async function clearBuffer(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY))
}
