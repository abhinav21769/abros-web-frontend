import { FadeIn } from "./fade-in";

export default function PageHeader({ title, heading, action }) {
  const displayHeading = heading || title;

  return (
    <FadeIn className="page-header" delay={0.02}>
      <div className="page-header-row">
        {displayHeading && <h2>{displayHeading}</h2>}
        {action && <div>{action}</div>}
      </div>
    </FadeIn>
  );
}
