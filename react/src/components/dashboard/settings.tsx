"use client"

import { useState, useEffect, useRef } from 'react'
import AuthGuard from '@/components/auth-guard'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
   const navigate = useNavigate()
   const [isLoading, setIsLoading] = useState(true)
   const [isSaving, setIsSaving] = useState(false)
   const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
   const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

   const [name, setName] = useState('')
   const [email, setEmail] = useState('')
   const [speciality, setSpeciality] = useState('')
   const [organisation, setOrganisation] = useState('')
   const [organisationName, setOrganisationName] = useState('')
   const [role, setRole] = useState('')

  useEffect(()=>{
    let mounted = true
    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
    
    async function func(){
      const token = typeof window !== 'undefined' ? (localStorage.getItem('hs_token') || sessionStorage.getItem('hs_token')) : null
      if (!token) {
        navigate('/login', { replace: true })
        if(mounted) setIsLoading(false)
        return
      }

      // Validate token server-side
      try{
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        
        if (!res.ok) {
          try {
            localStorage.removeItem('hs_token')
            sessionStorage.removeItem('hs_token')
          } catch {
            console.error('failed to clear invalid token')
          }
          navigate('/login', { replace: true })
          if(mounted) setIsLoading(false)
          return
        }
        
        const data = await res.json()
        console.log('User data:', data)
        
        if(mounted && data.user){
          // For organizations, use admin field; for doctors, use name field
          const displayName = data.user.role === 'organization' 
            ? (data.user.profile?.admin || "") 
            : (data.user.profile?.name || "")
          setName(displayName)
          setEmail(data.user.email || "")
          setRole(data.user.role || "")
          setSpeciality(data.user.profile?.specialty || "")
          const orgId = data.user.profile?.organizationId || ""
          setOrganisation(orgId)
          
          // Fetch organization name if orgId exists and user is organization admin
          if (orgId && data.user.role === 'organization') {
            try {
              const orgRes = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (orgRes.ok) {
                const orgData = await orgRes.json()
                console.log('Organization data:', orgData)
                if (mounted) setOrganisationName(orgData.name || "")
              }
            } catch (err) {
              console.error('Failed to fetch organization name:', err)
            }
          } else if (orgId) {
            // For doctors, orgId might be the organization name already or needs different handling
            setOrganisationName(orgId)
          }
        }
      }catch(error){
        console.error("Error in fetching data:", error)
        if(mounted) setIsLoading(false)
      }
      finally{
        if(mounted) setIsLoading(false)
      }
    }
    func()
    return () => { mounted = false }
  },[navigate])

  // Function to update user profile
  const updateProfile = async (updates: { name?: string; email?: string; specialty?: string; organizationId?: string }, showMessage: boolean = false) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('hs_token') || sessionStorage.getItem('hs_token')) : null
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000'
    if (showMessage) {
      setIsSaving(true)
      setSaveStatus('idle')
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const data = await res.json()
      
      // Only show success message if showMessage is true
      if (showMessage) {
        setSaveStatus('success')
        // Clear success message after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
      
      // Update local state with response data
      if (data.user) {
        // For organizations, check admin field; for doctors, check name field
        const updatedName = data.user.role === 'organization'
          ? (data.user.profile?.admin || "")
          : (data.user.profile?.name || "")
        if (updatedName !== undefined) setName(updatedName)
        if (data.user.email !== undefined) setEmail(data.user.email || "")
        if (data.user.profile?.specialty !== undefined) setSpeciality(data.user.profile.specialty || "")
        if (data.user.profile?.organizationId !== undefined) setOrganisation(data.user.profile.organizationId || "")
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      // Only show error message if showMessage is true
      if (showMessage) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } finally {
      if (showMessage) {
        setIsSaving(false)
      }
    }
  }

  // Debounced auto-save function (silent - no messages)
  const debouncedUpdate = (updates: { name?: string; admin?: string; email?: string; specialty?: string; organizationId?: string }) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      updateProfile(updates, false) // false = don't show success/error messages
    }, 1500) // Wait 1.5 seconds after user stops typing
  }

  // Handle input changes with auto-save
  const handleNameChange = (value: string) => {
    setName(value)
    // For organizations, update admin field; for doctors, update name field
    if (role === 'organization') {
      debouncedUpdate({ admin: value })
    } else {
      debouncedUpdate({ name: value })
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    debouncedUpdate({ email: value })
  }

  const handleSpecialityChange = (value: string) => {
    setSpeciality(value)
    debouncedUpdate({ specialty: value })
  }

  const handleOrganisationChange = (value: string) => {
    setOrganisation(value)
    debouncedUpdate({ organizationId: value })
  }

  // Manual save button handler (shows success/error messages)
  const handleSaveClick = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    // For organizations, use admin field; for doctors, use name field
    const updates: any = {
      email,
      specialty: speciality,
      organizationId: organisation
    }
    if (role === 'organization') {
      updates.admin = name
    } else {
      updates.name = name
    }
    updateProfile(updates, true) // true = show success/error messages
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  if (isLoading) {
        return (
            <AuthGuard>
                <div className="flex justify-center items-center min-h-[90vh]">
                    {/* You can replace this with a proper spinner component */}
                    <p className="dark:text-white">Loading user data...</p>
                </div>
            </AuthGuard>
        )
    }
  return (
    <AuthGuard>
            <div className=" min-h-[90vh] md:min-h-[85vh]  dark:bg-[#07232b] bg-[#eaf6ff] dark:border-none border border-gray-300/60 shadow-md shadow:xl rounded-xl relative">

        <div className="bg-linear-to-tr dark:from-[#51757e] from-[#f3faff] to-[#aad0ee] dark:to-[#0e3842] h-28 rounded-t-xl border-b border-border-gray-400/80"></div>

       <div className="absolute top-14 left-0 right-0 flex items-start px-10 ">

          <div className="flex flex-col md:px-10 ">
            <div className="md:h-28 h-24 md:w-28 w-24 rounded-full border-3 dark:border-gray-800 border-gray-400 bg-primary/80 flex items-center justify-center">
              <span className="dark:text-white md:text-4xl text-3xl font-bold text-primary">
                {name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'YN'}
              </span>
            </div>

            <div className=" dark:text-white mt-3 text-left space-y-1">
              <p className="md:text-2xl text-lg font-semibold ">{name || 'Your Name'}</p>
              <p className="opacity-80 text-sm ">{role === 'organization' ? 'Admin' : (speciality || 'Your Specialization')}</p>
              {role === 'organization' && <p className="opacity-80 text-sm ">{organisationName || 'Your Organisation'}</p>}
            </div>
          </div>
        </div>

        {/* Form Section */}
       <div className="pt-34 md:pt-40 px-10 md:px-20 mt-2 ">
          <div className="grid gap-6 md:grid-cols-2 md:gap-15 ">

            <div className="flex flex-col">
              <div className="my-1 md:my-2 flex flex-col">
                <label htmlFor='name'>Full Name</label>
                <input type="text" id='name' placeholder="Your Full Name" className="border p-2 rounded bg-[#bfdaf0] dark:bg-[#17454f] md:my-4 my-3" value={name} onChange={(e)=>handleNameChange(e.target.value)}/>
              </div>

              {role !== 'organization' && (
                <div className="my-1 md:my-2 flex flex-col">
                  <label htmlFor='specialisation'>Specialization</label>
                  <input type="text" id='specialisation' placeholder="Your Specialization" className="border p-2 rounded dark:bg-[#17454f] bg-[#bfdaf0] md:my-4 my-3" value={speciality} onChange={(e)=>handleSpecialityChange(e.target.value)}/>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <div className="my-1 md:my-2 flex flex-col">
                <label htmlFor="email" >Email</label>
                <input type="text" id='email' placeholder="Your Email" className="border p-2 rounded bg-[#bfdaf0] dark:bg-[#17454f] md:my-4 my-3" value={email} onChange={(e)=>handleEmailChange(e.target.value)}/>
              </div>

            </div>
           
          </div>
          

          <div className="flex justify-end items-center gap-4 my-6 md:my-8">
            {saveStatus === 'success' && (
              <span className="text-green-600 dark:text-green-400 text-sm">Saved successfully!</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400 text-sm">Failed to save. Please try again.</span>
            )}
            {isSaving && (
              <span className="text-gray-600 dark:text-gray-400 text-sm">Saving...</span>
            )}
            <button 
              onClick={handleSaveClick}
              disabled={isSaving}
              className="h-9 md:h-10 w-28 md:w-34 text-sm dark:text-black text-white bg-[#0f709c] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0d5f7a] transition-colors">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </AuthGuard>
  )
}