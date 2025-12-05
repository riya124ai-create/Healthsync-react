"use client"

import { useState } from "react"
import Sidebar from "./sidebar"
import Header from "./dashboard-header"
import { Outlet } from "react-router-dom"

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.02),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.02),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_80%,rgba(14,165,233,0.05),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,165,233,0.005)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.005)_1px,transparent_1px)] bg-[size:6rem_6rem] dark:bg-[linear-gradient(90deg,rgba(14,165,233,0.01)_1px,transparent_1px),linear-gradient(rgba(14,165,233,0.01)_1px,transparent_1px)]" />
      
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out relative z-10 ${
        sidebarOpen ? 'md:ml-64' : 'md:ml-0'
      }`}>
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-auto backdrop-blur-sm">
          <div className="max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
