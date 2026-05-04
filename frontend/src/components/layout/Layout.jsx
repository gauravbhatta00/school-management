import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header  from './Header'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 ml-60 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
