// layouts/SectionWrapper.tsx
export default function SectionWrapper({
  children,
  backgroundColor = "bg-white",
  isBox = false,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
  isBox?: boolean;
}) {
  return isBox ? (
    //TODO : 반응형 처리
    <div className="mx-auto max-w-[333px] min-[410px]:max-w-[381px] min-[540px]:max-w-[504px] min-[660px]:max-w-[632px] md:max-w-[744px] lg:max-w-[992px] xl:max-w-[1232px]">
      <div
        className={`px-3 py-2 lg:px-4 lg:py-3 rounded-xl ${backgroundColor}`}
      >
        {children}
      </div>
    </div>
  ) : (
    <div className={`w-full ${backgroundColor}`}>
      <div className="mx-auto max-w-[312px] min-[410px]:max-w-[360px] min-[540px]:max-w-[480px] min-[660px]:max-w-[600px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px]">
        {children}
      </div>
    </div>
  );
}
