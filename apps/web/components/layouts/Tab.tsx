// components/layouts/Tab.tsx
import StatusCard from "../ui/StatusCard";
import UptimeList from "../ui/UptimeList";

export default function Tab({
  network,
  date,
  setDate,
  tabBackgroundColor,
  setTabBackgroundColor,
}: {
  network: string;
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
  tabBackgroundColor: string;
  setTabBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <div className="bg-white">
      <StatusCard
        network={network}
        tabBackgroundColor={tabBackgroundColor}
        setTabBackgroundColor={setTabBackgroundColor}
      />
      <UptimeList network={network} date={date} setDate={setDate} />
    </div>
  );
}