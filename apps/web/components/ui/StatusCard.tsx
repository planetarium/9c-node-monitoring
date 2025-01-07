import SectionWrapper from "@/components/layouts/SectionWrapper";

export default function StatusCard({ network }: { network: string }) {
  const isHealthy = true; // API 연동 필요

  return (
    <SectionWrapper backgroundColor={isHealthy ? "bg-green-500" : "bg-red-500"}>
      <div className="max-w-[1190px] mx-auto py-4">
        {/*TODO: 반응형으로 크기에 따라 조정*/}
        <h2 className="text-white font-bold">
          {isHealthy
            ? `No problems detected with ${network} right now.`
            : `Issues detected in some nodes of ${network}.`}
        </h2>
      </div>
    </SectionWrapper>
  );
}
