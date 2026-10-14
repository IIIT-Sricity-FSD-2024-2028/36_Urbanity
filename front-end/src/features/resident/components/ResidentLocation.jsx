import { Card, EmptyState } from "../../../components/ui/index.js";
import { MetricIcon } from "../../../components/data-display/index.js";

export function ResidentLocation({ hierarchy }) {
  if (!hierarchy) return <EmptyState title="Location unavailable" message="Contact your Community Admin to check your apartment association." />;
  const { community, tower, floor, apartment } = hierarchy;
  return <Card className="resident-home-card" title="Your home">
    <div className="resident-home-heading"><span className="resident-issue-icon"><MetricIcon name="communities" /></span>
      <div><strong>{community?.name || "Community unavailable"}</strong><p>{community?.address || "Address not provided"}</p></div>
    </div>
    <dl className="resident-home-facts">
      {[
        ["Tower", tower?.name],
        ["Floor", floor?.label ?? floor?.floorNumber],
        ["Apartment", apartment?.label || apartment?.apartmentNumber],
      ].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? "Not available"}</dd></div>)}
    </dl>
    <p className="resident-note">This is your registered location. Your Community Admin manages apartment associations.</p>
  </Card>;
}
