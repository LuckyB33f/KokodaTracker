import test from 'node:test'
import assert from 'node:assert/strict'
import { normaliseMealText, fnv1a64, libraryIdFor } from './mealText'

test('normaliseMealText: case, whitespace and punctuation collapse', () => {
  assert.equal(
    normaliseMealText('  Chicken & Rice,  with veg!! '),
    'chicken rice with veg',
  )
  assert.equal(normaliseMealText('CHICKEN and rice'), 'chicken and rice')
  assert.equal(normaliseMealText('weet-bix + milk'), 'weet bix milk')
})

test('normaliseMealText: keeps unicode letters and digits', () => {
  assert.equal(normaliseMealText('Açaí bowl ×2'), 'açaí bowl 2')
})

test('fnv1a64: stable known vectors', () => {
  // Classic FNV-1a 64 test vectors.
  assert.equal(fnv1a64(''), 'cbf29ce484222325')
  assert.equal(fnv1a64('a'), 'af63dc4c8601ec8c')
})

test('libraryIdFor: same meal in different casing/punctuation collides', () => {
  assert.equal(
    libraryIdFor('Chicken & rice, with veg'),
    libraryIdFor('chicken   rice with veg'),
  )
})

test('libraryIdFor: distinct meals get distinct ids', () => {
  assert.notEqual(libraryIdFor('chicken and rice'), libraryIdFor('tuna pasta'))
})

test('libraryIdFor: 16-char lowercase hex', () => {
  assert.match(libraryIdFor('porridge with banana'), /^[0-9a-f]{16}$/)
})
