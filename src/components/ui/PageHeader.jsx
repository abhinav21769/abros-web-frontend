export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
