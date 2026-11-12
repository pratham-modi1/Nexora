// Picks the data layer: in-browser sample data (VITE_DEMO=true) or the real Spring Boot backend.
import { DEMO } from '../api'
import * as mock from './mock'
import * as live from './live'

export { DEMO }
export const api = DEMO ? mock.api : live.api
export const LIMITS = DEMO ? mock.LIMITS : live.LIMITS
export const demo = mock.demo
export type { ApiError } from './mock'
