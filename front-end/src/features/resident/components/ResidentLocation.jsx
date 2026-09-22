import { Card, EmptyState } from "../../../components/ui/index.js";

export function ResidentLocation({ hierarchy }) {
  if (!hierarchy) return <EmptyState title="Location unavailable" message="Contact your Community Admin to check your apartment association." />;
  const { community, tower, floor, apartment } = hierarchy;
  return <Card title="My apartment">
    <dl className="resident-facts">
      {[
        ["Community", community?.name], ["Tower", tower?.name],
        ["Floor", floor?.label ?? floor?.floorNumber],
        ["Apartment", apartment?.label || apartment?.apartmentNumber],
        ["Address", community?.address],
      ].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? "Not available"}</dd></div>)}
    </dl>
  </Card>;
}
