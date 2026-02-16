'use client'

import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Users, Check, Loader2,
  Sparkles, FileText, RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react'
import AutopilotProfileWizard from './AutopilotProfileWizard'

export interface AutopilotProfile {
  id: string
  name: string
  color: string
  custom_instructions: string
  ai_setup_answers: Record<string, string> | null
  sort_order: number
  created_at: string
}

interface AutopilotContactInfo {
  contact_phone: string
  contact_name: string | null
  profile_id: string | null
  enabled: boolean
  needs_human: boolean
  objective_reached: boolean
}

interface AutopilotProfilesTabProps {
  profiles: AutopilotProfile[]
  contacts: Map<string, AutopilotContactInfo>
  authToken: string | null
  onProfileCreated: (profile: AutopilotProfile) => void
  onProfileUpdated: (profile: AutopilotProfile) => void
  onProfileDeleted: (profileId: string) => void
}

const PROFILE_COLORS = ['#00a884', '#53bdeb', '#d9a5f5', '#f5c542', '#ff6b6b', '#45b7d1']

export default function AutopilotProfilesTab({
  profiles,
  contacts,
  authToken,
  onProfileCreated,
  onProfileUpdated,
  onProfileDeleted
}: AutopilotProfilesTabProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [editingProfile, setEditingProfile] = useState<AutopilotProfile | null>(null)
  const [editInstructions, setEditInstructions] = useState('')
  const [showManualEdit, setShowManualEdit] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null)
  const [redoWizardProfile, setRedoWizardProfile] = useState<AutopilotProfile | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingResult, setPendingResult] = useState<{ name: string; instructions: string; answers: Record<string, string> } | null>(null)

  // Get current auth headers - uses getSession() for the auto-refreshed token
  // Do NOT call refreshSession() - concurrent calls cause race conditions
  const getFreshHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      }
    } catch {}
    return authToken
      ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  const getContactCountForProfile = (profileId: string | null) => {
    let count = 0
    contacts.forEach(c => {
      if (profileId === null ? !c.profile_id : c.profile_id === profileId) count++
    })
    return count
  }

  const getNextColor = () => {
    const usedColors = profiles.map(p => p.color)
    return PROFILE_COLORS.find(c => !usedColors.includes(c)) || PROFILE_COLORS[profiles.length % PROFILE_COLORS.length]
  }

  const handleWizardComplete = async (result: { name: string; instructions: string; answers: Record<string, string> }) => {
    setIsSaving(true)
    setSaveError(null)
    setPendingResult(result)

    try {
      const headers = await getFreshHeaders()
      if (redoWizardProfile) {
        // Updating existing profile with new instructions
        const res = await fetch('/api/autopilot/profiles', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'update',
            profile: {
              id: redoWizardProfile.id,
              custom_instructions: result.instructions,
              ai_setup_answers: result.answers
            }
          })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Erro ${res.status}`)
        }
        const { profile } = await res.json()
        onProfileUpdated(profile)
        setRedoWizardProfile(null)
        setShowWizard(false)
        setPendingResult(null)
      } else {
        // Creating new profile
        const res = await fetch('/api/autopilot/profiles', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'create',
            profile: {
              name: result.name,
              color: getNextColor(),
              custom_instructions: result.instructions,
              ai_setup_answers: result.answers
            }
          })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Erro ${res.status}`)
        }
        const { profile } = await res.json()
        onProfileCreated(profile)
        setShowWizard(false)
        setPendingResult(null)
      }
    } catch (err: any) {
      console.error('Profile save error:', err)
      setSaveError(err.message || 'Erro ao salvar perfil')
      // DON'T close wizard or reset state - keep pending result for retry
    } finally {
      setIsSaving(false)
    }
  }

  // Retry saving a pending result
  const handleRetrySave = () => {
    if (pendingResult) {
      handleWizardComplete(pendingResult)
    }
  }

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', profile: { id: profileId } })
      })
      if (res.ok) {
        onProfileDeleted(profileId)
        if (editingProfile?.id === profileId) setEditingProfile(null)
      }
    } catch (err) {
      console.error('Profile delete error:', err)
    }
  }

  const handleSaveManualEdit = async () => {
    if (!editingProfile) return
    setIsSaving(true)
    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update',
          profile: {
            id: editingProfile.id,
            custom_instructions: editInstructions
          }
        })
      })
      if (res.ok) {
        const { profile } = await res.json()
        onProfileUpdated(profile)
        setEditingProfile(null)
        setShowManualEdit(false)
      }
    } catch (err) {
      console.error('Manual save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // First-time experience: show wizard (or pending save result)
  if (profiles.length === 0 || showWizard || redoWizardProfile) {
    // If we have a pending result (save failed), show save state instead of fresh wizard
    if (pendingResult && !showWizard && !redoWizardProfile) {
      return (
        <div className="flex flex-col h-full items-center justify-center px-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-[#e9edef] text-[16px] font-medium mb-2">Perfil: {pendingResult.name}</h3>
          <div className="bg-[#202c33] rounded-xl p-3 mb-4 w-full max-w-[400px]">
            <p className="text-[#8696a0] text-[10px] mb-1 uppercase tracking-wider">Instrucoes geradas</p>
            <p className="text-[#e9edef] text-[12px] leading-relaxed whitespace-pre-wrap line-clamp-6">
              {pendingResult.instructions}
            </p>
          </div>
          {saveError && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3 mb-4 w-full max-w-[400px]">
              <p className="text-red-400 text-[12px]">Erro ao salvar: {saveError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPendingResult(null)
                setSaveError(null)
              }}
              className="text-[12px] px-4 py-2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
            >
              Recomecar
            </button>
            <button
              onClick={handleRetrySave}
              disabled={isSaving}
              className="text-[12px] px-5 py-2 bg-[#00a884] text-white rounded-full font-medium hover:bg-[#00a884]/90 transition-colors flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isSaving ? 'Salvando...' : 'Tentar salvar novamente'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {profiles.length === 0 && !showWizard && !redoWizardProfile ? (
          <>
            <div className="px-4 pt-6 pb-3 text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[#e9edef] text-[16px] font-medium">Configure seu assistente de vendas</h3>
              <p className="text-[#8696a0] text-[13px] mt-1.5 max-w-[320px] mx-auto">
                Crie perfis de lead para que a IA saiba como conversar com cada tipo de cliente
              </p>
            </div>
            <AutopilotProfileWizard
              onComplete={handleWizardComplete}
              onCancel={() => setShowWizard(false)}
              authToken={authToken}
              profileColors={PROFILE_COLORS}
            />
          </>
        ) : (
          <AutopilotProfileWizard
            onComplete={handleWizardComplete}
            onCancel={() => {
              setShowWizard(false)
              setRedoWizardProfile(null)
            }}
            authToken={authToken}
            initialName={redoWizardProfile?.name || ''}
            initialAnswers={redoWizardProfile?.ai_setup_answers || undefined}
            profileColors={PROFILE_COLORS}
          />
        )}
      </div>
    )
  }

  // Profile editor inline
  if (editingProfile) {
    return (
      <div className="p-4 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setEditingProfile(null); setShowManualEdit(false) }}
            className="text-[#8696a0] hover:text-[#e9edef] transition-colors text-[13px]"
          >
            ← Voltar
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editingProfile.color }} />
            <span className="text-[#e9edef] text-[15px] font-medium">{editingProfile.name}</span>
          </div>
        </div>

        {/* Instructions preview */}
        <div className="bg-[#202c33] rounded-xl p-3 mb-3">
          <p className="text-[#8696a0] text-[11px] mb-1.5 uppercase tracking-wider">Instruções do perfil</p>
          {showManualEdit ? (
            <>
              <textarea
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                maxLength={2000}
                className="w-full bg-[#2a3942] text-[#e9edef] text-[13px] rounded-xl p-3 resize-y min-h-[150px] placeholder-[#8696a0]/50 outline-none focus:ring-1 focus:ring-[#00a884]/40 transition-all leading-relaxed"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[#8696a0] text-[11px]">{editInstructions.length}/2000</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowManualEdit(false)}
                    className="text-[11px] px-3 py-1.5 text-[#8696a0] hover:text-[#e9edef] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveManualEdit}
                    disabled={isSaving}
                    className="text-[12px] px-4 py-1.5 bg-[#00a884] text-white rounded-full font-medium hover:bg-[#00a884]/90 transition-colors flex items-center gap-1.5"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[#e9edef] text-[13px] leading-relaxed whitespace-pre-wrap">
              {editingProfile.custom_instructions || 'Nenhuma instrução configurada'}
            </p>
          )}
        </div>

        {/* Actions */}
        {!showManualEdit && (
          <div className="space-y-2">
            <button
              onClick={() => {
                setRedoWizardProfile(editingProfile)
                setEditingProfile(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#202c33] rounded-xl hover:bg-[#2a3942] transition-colors"
            >
              <Sparkles className="w-4 h-4 text-[#00a884]" />
              <div className="text-left">
                <p className="text-[#e9edef] text-[13px]">Refazer com IA</p>
                <p className="text-[#8696a0] text-[11px]">Responda as perguntas novamente para gerar novas instruções</p>
              </div>
            </button>
            <button
              onClick={() => {
                setEditInstructions(editingProfile.custom_instructions)
                setShowManualEdit(true)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#202c33] rounded-xl hover:bg-[#2a3942] transition-colors"
            >
              <Pencil className="w-4 h-4 text-[#53bdeb]" />
              <div className="text-left">
                <p className="text-[#e9edef] text-[13px]">Editar manualmente</p>
                <p className="text-[#8696a0] text-[11px]">Ajuste o texto das instruções diretamente</p>
              </div>
            </button>
            <button
              onClick={() => handleDeleteProfile(editingProfile.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#202c33] rounded-xl hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <div className="text-left">
                <p className="text-red-400 text-[13px]">Excluir perfil</p>
                <p className="text-[#8696a0] text-[11px]">Contatos ficarão sem perfil atribuído</p>
              </div>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Profile cards dashboard
  const unassignedCount = getContactCountForProfile(null)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#e9edef] text-[14px] font-medium">Seus Perfis</span>
        <button
          onClick={() => setShowWizard(true)}
          className="text-[12px] px-3 py-1.5 bg-[#00a884] text-white rounded-full font-medium hover:bg-[#00a884]/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Perfil
        </button>
      </div>

      {profiles.map(profile => {
        const contactCount = getContactCountForProfile(profile.id)
        const isExpanded = expandedProfileId === profile.id

        return (
          <div
            key={profile.id}
            className="bg-[#202c33] rounded-xl overflow-hidden transition-all"
          >
            <div
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#2a3942]/50 transition-colors"
              onClick={() => setExpandedProfileId(isExpanded ? null : profile.id)}
            >
              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: profile.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[#e9edef] text-[14px] font-medium truncate">{profile.name}</p>
                <p className="text-[#8696a0] text-[11px] flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {contactCount} contato{contactCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingProfile(profile) }}
                className="text-[#8696a0] hover:text-[#00a884] transition-colors p-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#8696a0]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#8696a0]" />
              )}
            </div>

            {isExpanded && (
              <div className="px-4 pb-3 border-t border-[#2a3942]">
                <p className="text-[#8696a0] text-[11px] mt-2 mb-1 uppercase tracking-wider">Instruções</p>
                <p className="text-[#e9edef] text-[12px] leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {profile.custom_instructions || 'Nenhuma instrução configurada'}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned contacts warning */}
      {unassignedCount > 0 && (
        <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl px-4 py-3">
          <p className="text-amber-400 text-[12px]">
            {unassignedCount} contato{unassignedCount !== 1 ? 's' : ''} sem perfil atribuído
          </p>
          <p className="text-[#8696a0] text-[11px] mt-0.5">
            Atribua um perfil na aba Contatos para instruções personalizadas
          </p>
        </div>
      )}
    </div>
  )
}
