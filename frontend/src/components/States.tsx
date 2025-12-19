import React from "react";

export function LoadingGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card empty">
      <div className="empty-title">{title}</div>
      {description && <div className="muted">{description}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card error">
      <div className="error-title">Произошла ошибка</div>
      <div className="muted">{message}</div>
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
