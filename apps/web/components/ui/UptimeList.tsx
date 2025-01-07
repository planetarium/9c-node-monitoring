import DayUptimeSection from "./DayUptimeSection";

export default function UptimeList({ network }: { network: string }) {
  const nodes = ["1", "2", "3", "4", "5"]; //노드별로 map으로 넣기

  return (
    <div style={{ backgroundColor: "var(--background)" }}>
      <div className="mt-7 mb-8">
        <DayUptimeSection network={network} isBox={false} />
      </div>
      <div className="pb-2">
        {nodes.map((node, index) => (
          <div className="mb-4" key={index}>
            <DayUptimeSection network={network} node={node} isBox={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
