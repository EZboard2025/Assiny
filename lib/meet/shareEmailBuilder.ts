export function escHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildSmartNotesHtml(notes: any): string {
  if (!notes || typeof notes !== 'object') return ''
  let html = ''

  // Lead info
  if (notes.lead_name || notes.lead_company || notes.lead_role) {
    const parts = [notes.lead_name, notes.lead_role, notes.lead_company].filter(Boolean)
    html += `<div style="background:#f0fdf4;border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <p style="color:#15803d;font-size:12px;font-weight:600;margin:0 0 4px">Lead</p>
      <p style="color:#166534;font-size:14px;margin:0;font-weight:500">${escHtml(parts.join(' · '))}</p>
    </div>`
  }

  // Sections
  if (notes.sections?.length) {
    for (const section of notes.sections) {
      html += `<div style="margin-bottom:16px">
        <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 8px">${escHtml(section.title)}${section.priority === 'high' ? ' <span style="background:#dcfce7;color:#15803d;font-size:10px;padding:2px 6px;border-radius:8px;font-weight:600">Importante</span>' : ''}</p>`
      if (section.insight) {
        html += `<p style="color:#15803d;font-size:12px;background:#f0fdf4;border-radius:8px;padding:8px 12px;margin:0 0 8px;line-height:1.5">${escHtml(section.insight)}</p>`
      }
      if (section.items?.length) {
        for (const item of section.items) {
          html += `<div style="margin-bottom:8px;padding-left:8px;border-left:2px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:11px;margin:0 0 2px">${escHtml(item.label)}</p>
            <p style="color:#374151;font-size:13px;margin:0;line-height:1.5">${escHtml(item.value)}</p>`
          if (item.transcript_ref) {
            html += `<p style="color:#9ca3af;font-size:11px;font-style:italic;margin:4px 0 0;padding-left:8px;border-left:2px solid #d1d5db">"${escHtml(item.transcript_ref)}"</p>`
          }
          html += '</div>'
        }
      }
      html += '</div>'
    }
  }

  // Next steps
  if (notes.next_steps?.length) {
    html += `<div style="margin-bottom:12px">
      <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 8px">Próximos Passos</p>`
    notes.next_steps.forEach((step: any, idx: number) => {
      const ownerLabel = step.owner === 'seller' ? 'Vendedor' : step.owner === 'client' ? 'Cliente' : 'Ambos'
      html += `<div style="margin-bottom:8px;display:flex;gap:8px">
        <span style="background:#dcfce7;color:#15803d;width:20px;height:20px;border-radius:50%;display:inline-block;text-align:center;line-height:20px;font-size:11px;font-weight:700;flex-shrink:0">${idx + 1}</span>
        <div>
          <p style="color:#374151;font-size:13px;margin:0;line-height:1.4">${escHtml(step.action)}</p>
          <p style="color:#9ca3af;font-size:11px;margin:2px 0 0">${escHtml(ownerLabel)}${step.deadline ? ` · ${escHtml(step.deadline)}` : ''}</p>
        </div>
      </div>`
    })
    html += '</div>'
  }

  // Deal status
  if (notes.deal_status) {
    const tempLabel = notes.deal_status.temperature === 'hot' ? 'Quente' : notes.deal_status.temperature === 'warm' ? 'Morno' : 'Frio'
    const tempColor = notes.deal_status.temperature === 'hot' ? '#16a34a' : notes.deal_status.temperature === 'warm' ? '#d97706' : '#2563eb'
    html += `<div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:8px">
      <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 6px">Status da Oportunidade</p>
      <p style="margin:0 0 4px"><span style="color:${tempColor};font-size:14px;font-weight:700">${tempLabel}</span>${notes.deal_status.probability ? ` <span style="color:#6b7280;font-size:12px">· ${escHtml(String(notes.deal_status.probability))}</span>` : ''}</p>`
    if (notes.deal_status.summary) {
      html += `<p style="color:#6b7280;font-size:12px;margin:0;line-height:1.5">${escHtml(notes.deal_status.summary)}</p>`
    }
    html += '</div>'
  }

  return html
}

export function buildTranscriptHtml(transcript: any[]): string {
  if (!transcript?.length) return ''
  const segments = transcript.slice(0, 60)
  let html = ''

  for (const seg of segments) {
    const speaker = seg.speaker || 'Desconhecido'
    const text = seg.text || seg.words?.map((w: any) => w.text).join(' ') || ''
    if (!text.trim()) continue
    html += `<div style="margin-bottom:8px">
      <p style="color:#6b7280;font-size:11px;font-weight:600;margin:0 0 2px">${escHtml(speaker)}</p>
      <p style="color:#374151;font-size:13px;margin:0;line-height:1.5">${escHtml(text)}</p>
    </div>`
  }

  if (transcript.length > 60) {
    html += `<p style="color:#9ca3af;font-size:12px;margin:8px 0 0;font-style:italic">... e mais ${transcript.length - 60} segmentos. Veja a transcrição completa na plataforma.</p>`
  }

  return html
}

export function buildEvaluationHtml(evaluation: any): string {
  if (!evaluation || typeof evaluation !== 'object') return ''
  let html = ''

  if (evaluation.overall_score !== undefined) {
    const score = Number(evaluation.overall_score)
    const scoreColor = score >= 7 ? '#16a34a' : score >= 4 ? '#d97706' : '#dc2626'
    html += `<div style="text-align:center;margin-bottom:16px">
      <p style="font-size:36px;font-weight:800;color:${scoreColor};margin:0">${score.toFixed(1)}</p>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0">${escHtml(evaluation.performance_level || '')}</p>
    </div>`
  }

  if (evaluation.executive_summary) {
    html += `<div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <p style="color:#374151;font-size:13px;margin:0;line-height:1.6">${escHtml(evaluation.executive_summary)}</p>
    </div>`
  }

  if (evaluation.top_strengths?.length) {
    html += `<div style="margin-bottom:12px">
      <p style="color:#15803d;font-size:13px;font-weight:700;margin:0 0 6px">Pontos Fortes</p>`
    for (const s of evaluation.top_strengths) {
      html += `<p style="color:#166534;font-size:12px;margin:0 0 4px;padding-left:12px;line-height:1.4">• ${escHtml(s)}</p>`
    }
    html += '</div>'
  }

  if (evaluation.critical_gaps?.length) {
    html += `<div style="margin-bottom:12px">
      <p style="color:#dc2626;font-size:13px;font-weight:700;margin:0 0 6px">Gaps Críticos</p>`
    for (const g of evaluation.critical_gaps) {
      html += `<p style="color:#991b1b;font-size:12px;margin:0 0 4px;padding-left:12px;line-height:1.4">• ${escHtml(g)}</p>`
    }
    html += '</div>'
  }

  return html
}

export function buildSpinHtml(evaluation: any, spinScores: { s: number | null, p: number | null, i: number | null, n: number | null }): string {
  let html = ''
  const scores = [
    { label: 'Situação (S)', score: spinScores.s, color: '#2563eb' },
    { label: 'Problema (P)', score: spinScores.p, color: '#7c3aed' },
    { label: 'Implicação (I)', score: spinScores.i, color: '#c026d3' },
    { label: 'Necessidade (N)', score: spinScores.n, color: '#059669' },
  ]

  for (const item of scores) {
    if (item.score === null || item.score === undefined) continue
    const pct = Math.round((item.score / 10) * 100)
    const barColor = item.score >= 7 ? '#16a34a' : item.score >= 4 ? '#d97706' : '#dc2626'
    html += `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:#374151;font-size:13px;font-weight:600">${item.label}</span>
        <span style="color:${barColor};font-size:13px;font-weight:700">${item.score.toFixed(1)}</span>
      </div>
      <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${barColor};height:100%;width:${pct}%;border-radius:4px"></div>
      </div>`
    const spinKey = item.label.includes('Situação') ? 'S' : item.label.includes('Problema') ? 'P' : item.label.includes('Implicação') ? 'I' : 'N'
    const spinDetail = evaluation?.spin_evaluation?.[spinKey]
    if (spinDetail?.technical_feedback) {
      html += `<p style="color:#6b7280;font-size:11px;margin:4px 0 0;line-height:1.4">${escHtml(spinDetail.technical_feedback)}</p>`
    }
    html += '</div>'
  }

  return html
}

export function buildShareEmailHtml(
  senderName: string,
  meetingName: string,
  sectionNames: string,
  userMessage: string | null,
  appUrl: string,
  sections: string[],
  evalData: any
): string {
  let contentBlocks = ''

  if (sections.includes('smart_notes') && evalData.smart_notes) {
    const notesHtml = buildSmartNotesHtml(evalData.smart_notes)
    if (notesHtml) {
      contentBlocks += `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="color:#16a34a;font-size:14px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #dcfce7">Notas Inteligentes</p>
        ${notesHtml}
      </div>`
    }
  }

  if (sections.includes('spin')) {
    const spinHtml = buildSpinHtml(evalData.evaluation, {
      s: evalData.spin_s_score,
      p: evalData.spin_p_score,
      i: evalData.spin_i_score,
      n: evalData.spin_n_score,
    })
    if (spinHtml) {
      contentBlocks += `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="color:#7c3aed;font-size:14px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #ede9fe">Análise SPIN</p>
        ${spinHtml}
      </div>`
    }
  }

  if (sections.includes('evaluation') && evalData.evaluation) {
    const evalHtml = buildEvaluationHtml(evalData.evaluation)
    if (evalHtml) {
      contentBlocks += `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="color:#d97706;font-size:14px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #fef3c7">Avaliação Detalhada</p>
        ${evalHtml}
      </div>`
    }
  }

  if (sections.includes('transcript') && evalData.transcript?.length) {
    const transcriptHtml = buildTranscriptHtml(evalData.transcript)
    if (transcriptHtml) {
      contentBlocks += `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="color:#7c3aed;font-size:14px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #ede9fe">Transcrição</p>
        ${transcriptHtml}
      </div>`
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:24px 32px">
        <img src="${appUrl}/images/logotipo-nome.png" alt="Ramppy" style="height:32px;display:block" />
      </div>
      <div style="padding:32px">
        <h2 style="color:#111827;font-size:18px;margin:0 0 8px">${escHtml(senderName)} compartilhou uma reunião</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Reunião: <strong style="color:#374151">${escHtml(meetingName)}</strong></p>

        ${userMessage ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="color:#1e40af;font-size:13px;font-weight:600;margin:0 0 4px">Mensagem:</p>
          <p style="color:#1e3a5f;font-size:14px;margin:0;font-style:italic">"${escHtml(userMessage)}"</p>
        </div>
        ` : ''}

        ${contentBlocks}

        <div style="text-align:center;margin-top:24px">
          <a href="${appUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600">
            Ver na Plataforma
          </a>
          <p style="color:#9ca3af;font-size:11px;margin:8px 0 0">Para ver todos os detalhes interativos</p>
        </div>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #f3f4f6">
        <p style="color:#9ca3af;font-size:11px;margin:0">Enviado automaticamente pela Ramppy</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
