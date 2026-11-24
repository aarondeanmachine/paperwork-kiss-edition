/**
 * Sample images used by the insert menu.
 * If sample_photo.jpeg (or .jpg) is dropped into the project folder it is used;
 * until then a generated placeholder stands in for it.
 */
const provided = import.meta.glob<string>('../../sample_photo.{jpeg,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** Files in public/ are served next to the page, wherever the app is hosted. */
const publicFile = (name: string) => `${import.meta.env.BASE_URL}${name}`

export const PHOTO_SRC = Object.values(provided)[0] ?? publicFile('sample_photo_placeholder.jpg')
export const SIGNATURE_SRC = publicFile('signature_example.png')
