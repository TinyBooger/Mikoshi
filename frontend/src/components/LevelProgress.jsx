import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * LevelProgress: Displays user's level, name, unlocks, and EXP progress.
 * Uses Bootstrap 5 with custom styling to match site aesthetic (#111 borders, rounded).
 */
export default function LevelProgress({ level = 1, exp = 0 }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [showLevelsTable, setShowLevelsTable] = useState(false);

  const LEVELS = useMemo(() => ({
    1: {
      name: t('level_progress.level_names.L1', 'Newbie'),
      unlock: t('level_progress.unlocks.L1', 'Create chars, scenes, personas'),
      exp_required: 0,
    },
    2: {
      name: t('level_progress.level_names.L2', 'Creator'),
      unlock: t('level_progress.unlocks.L2', 'Fork, private chars'),
      exp_required: 100,
    },
    3: {
      name: t('level_progress.level_names.L3', 'Advanced'),
      unlock: t('level_progress.unlocks.L3', '1 paid char, basic analytics'),
      exp_required: 300,
    },
    4: {
      name: t('level_progress.level_names.L4', 'Pro'),
      unlock: t('level_progress.unlocks.L4', '2 paid chars, prompt controls'),
      exp_required: 700,
    },
    5: {
      name: t('level_progress.level_names.L5', 'Elite'),
      unlock: t('level_progress.unlocks.L5', 'Featured chance, beta tools'),
      exp_required: 1500,
    },
    6: {
      name: t('level_progress.level_names.L6', 'Master'),
      unlock: t('level_progress.unlocks.L6', 'Creator badge, early revenue tools'),
      exp_required: 3000,
    },
  }), [t]);

  const EXP_REWARDS = useMemo(() => ([
    { label: t('level_progress.rewards.create_character', 'Create character (+30)'), value: 30, limit: t('level_progress.daily_limits.create_character', '2/day') },
    { label: t('level_progress.rewards.create_scene', 'Create scene (+15)'), value: 15, limit: t('level_progress.daily_limits.create_scene', '2/day') },
    { label: t('level_progress.rewards.create_persona', 'Create persona (+15)'), value: 15, limit: t('level_progress.daily_limits.create_persona', '2/day') },
    { label: t('level_progress.rewards.character_liked', 'Character liked (+5)'), value: 5, limit: t('level_progress.daily_limits.character_liked', '20/day') },
    { label: t('level_progress.rewards.forked', 'Forked (+10)'), value: 10, limit: null },
    { label: t('level_progress.rewards.paid_char_sold', 'Paid char sold (+50)'), value: 50, limit: null },
    { label: t('level_progress.rewards.daily_chat', 'Daily chat (+20)'), value: 20, limit: t('level_progress.daily_limits.daily_chat', '1/day') },
  ]), [t]);

  const MAX_LEVEL = 6;
  const clampLevel = Math.min(Math.max(level || 1, 1), MAX_LEVEL);
  const current = LEVELS[clampLevel];
  const next = clampLevel < MAX_LEVEL ? LEVELS[clampLevel + 1] : null;

  const currentLevelBaseExp = current.exp_required;
  const nextLevelTotalExp = next ? next.exp_required : null;
  const expInCurrent = Math.max(exp - currentLevelBaseExp, 0);
  const expNeeded = next ? nextLevelTotalExp - currentLevelBaseExp : 0;
  const progressPct = next ? Math.min(100, Math.max(0, (expInCurrent / expNeeded) * 100)) : 100;
  const levelBadge = `Lv${clampLevel}`;

  return (
    <div
      className="w-100"
      style={{
        border: '2px solid #111',
        borderRadius: 16,
        background: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        padding: '16px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setShowDetails(v => !v)}
        aria-expanded={showDetails}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          border: '1.5px solid #111',
          background: showDetails ? '#111' : '#fff',
          color: showDetails ? '#fff' : '#111',
          borderRadius: 10,
          padding: '6px 10px',
          fontWeight: 700,
          fontSize: '0.78rem',
          lineHeight: 1.2,
          cursor: 'pointer',
          boxShadow: showDetails ? '0 6px 16px rgba(0,0,0,0.18)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        {t('level_progress.details_button', 'Level details')} {showDetails ? '–' : '+'}
      </button>
      <div className="d-flex align-items-start justify-content-between" style={{ gap: 12 }}>
        <div>
          <div className="d-flex align-items-center" style={{ gap: 10 }}>
            <span
              className="fw-bold"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 44,
                height: 32,
                padding: '0 10px',
                borderRadius: 10,
                border: '1.6px solid #111',
                background: 'linear-gradient(135deg, #fafafa, #f1f1f1)',
                color: '#111',
                fontSize: '0.95rem',
              }}
            >
              {levelBadge}
            </span>
            <h5 className="mb-0 fw-bold" style={{ color: '#111' }}>{current.name}</h5>
          </div>
          <div className="text-muted mt-1" style={{ fontSize: '0.95rem' }}>
            {t('level_progress.unlocks_label', 'Unlocks:')}{' '}<span className="fw-semibold" style={{ color: '#333' }}>{current.unlock}</span>
          </div>
        </div>
        <div className="text-end" style={{ minWidth: 180 }}>
          <div className="fw-bold" style={{ color: '#111' }}>{exp.toLocaleString()} {t('level_progress.exp_label', 'EXP')}</div>
          {next ? (
            <small className="text-muted">{t('level_progress.next_label', 'Next:')} {next.exp_required.toLocaleString()} {t('level_progress.exp_label', 'EXP')}</small>
          ) : (
            <small className="text-success fw-semibold">{t('level_progress.max_level', 'Max level reached')}</small>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div
          className="progress"
          style={{
            height: 12,
            border: '1.5px solid #111',
            borderRadius: 999,
            background: 'linear-gradient(180deg, #f7f7f7, #efefef)',
          }}
        >
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin="0"
            aria-valuemax="100"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
            }}
          />
        </div>
        {next && (
          <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.9rem', color: '#555' }}>
            <span>{expInCurrent.toLocaleString()} / {expNeeded.toLocaleString()} EXP</span>
            <span>{Math.max(0, next.exp_required - exp).toLocaleString()} EXP to Lv{clampLevel + 1}</span>
          </div>
        )}
        {!next && (
          <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.9rem', color: '#28a745' }}>
            <span className="fw-semibold">{t('level_progress.max_level_body', 'You are at max level.')}</span>
            <span>{t('level_progress.keep_creating', 'Keep creating to stay featured!')}</span>
          </div>
        )}
      </div>

      {showDetails && (
        <div
          className="mt-3"
          style={{
            border: '1.5px solid #111',
            borderRadius: 14,
            padding: '12px 14px',
            background: 'linear-gradient(180deg, #fdfdfd, #f5f5f5)',
          }}
        >
          <div className="row" style={{ rowGap: 12 }}>
            <div className="col-12 col-md-6">
              <div className="fw-bold" style={{ color: '#111', marginBottom: 6 }}>{t('level_progress.unlock_path', 'Unlock path')}</div>
              <ul className="mb-0" style={{ paddingLeft: 18, color: '#444', fontSize: '0.95rem' }}>
                <li><strong>{current.name}</strong> — {current.unlock}</li>
                {next && <li><strong>{t('level_progress.next_level', 'Next')}: Lv{clampLevel + 1} {next.name}</strong> — {next.unlock}</li>}
                {!next && <li><strong>{t('level_progress.maxed', 'Maxed')}</strong> — {t('level_progress.maxed_desc', 'Enjoy all creator perks')}</li>}
              </ul>
              <button
                type="button"
                onClick={() => setShowLevelsTable(true)}
                style={{
                  marginTop: 8,
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#6366f1',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#4f46e5'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6366f1'}
              >
                {t('level_progress.view_all_levels', 'View all levels')} →
              </button>
            </div>
            <div className="col-12 col-md-6">
              <div className="fw-bold" style={{ color: '#111', marginBottom: 6 }}>{t('level_progress.earn_exp', 'Ways to earn EXP')}</div>
              <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                {EXP_REWARDS.map((item) => (
                  <span
                    key={item.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #f0f5ff, #f5f0ff)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      fontSize: '0.85rem',
                      color: '#2a2a2a',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #e0ebff, #ede0ff)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.12)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff, #f5f0ff)';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 18,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      +{item.value}
                    </span>
                    <span>{item.label.replace(/\s*\(\+\d+\)/, '')}</span>
                    {item.limit && (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#666',
                        marginLeft: 2,
                      }}>
                        ({item.limit})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLevelsTable && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '16px',
          }}
          onClick={() => setShowLevelsTable(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: '1.5px solid #111',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              maxWidth: 700,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ color: '#111', fontWeight: 800, marginBottom: 0 }}>{t('level_progress.level_requirements_title', 'Level Requirements')}</h4>
              <button
                type="button"
                onClick={() => setShowLevelsTable(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#666',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem',
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #111' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#111', fontWeight: 700 }}>{t('level_progress.table_level', 'Level')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#111', fontWeight: 700 }}>{t('level_progress.table_exp_required', 'EXP Required')}</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#111', fontWeight: 700 }}>{t('level_progress.table_benefits', 'Benefits')}</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((lvl) => (
                  <tr key={lvl} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '12px', color: '#222' }}>
                      <strong style={{ fontSize: '1.05rem' }}>Lv{lvl} {LEVELS[lvl].name}</strong>
                    </td>
                    <td style={{ padding: '12px', color: '#555', fontFamily: 'monospace' }}>
                      {LEVELS[lvl].exp_required.toLocaleString()} EXP
                    </td>
                    <td style={{ padding: '12px', color: '#333' }}>
                      {LEVELS[lvl].unlock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
