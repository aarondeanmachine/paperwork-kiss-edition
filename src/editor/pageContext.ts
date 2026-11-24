import { createContext } from 'react'

/** How the page an object sits on is drawn: needed to turn pointer movement into page units. */
export const PageContext = createContext({ scale: 1, rotation: 0 })
