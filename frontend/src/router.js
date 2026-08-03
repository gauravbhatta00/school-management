import { BrowserRouter, HashRouter } from 'react-router-dom'

// The desktop build is loaded by Electron via file://, which has no server
// to fall back to index.html for arbitrary nested paths — a refresh or
// reopen on e.g. file:///.../dist/students would 404. HashRouter keeps all
// routing state in the URL fragment instead, which file:// always resolves
// back to the same document. Scoped to the desktop build only; normal web
// (dev and deployed) keeps BrowserRouter unchanged.
export const Router = import.meta.env.MODE === 'desktop' ? HashRouter : BrowserRouter
