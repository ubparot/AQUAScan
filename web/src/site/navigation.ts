import { createContext, useContext } from 'react'
import type { SitePage } from './routes'

export const NavigateContext = createContext<(page: SitePage, hash?: string) => void>(() => undefined)

export function useNavigate() {
  return useContext(NavigateContext)
}
