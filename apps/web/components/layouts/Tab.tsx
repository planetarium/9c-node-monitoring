// components/layouts/Tab.tsx
import StatusCard from "../ui/StatusCard";
import UptimeList from "../ui/UptimeList";

export default function Tab({ network }: { network: string }) {
  return (
    <div className="bg-white">
      <StatusCard network={network} />
      <UptimeList network={network} />
    </div>
  );
}
