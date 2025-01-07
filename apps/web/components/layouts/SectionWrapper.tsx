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
    <div className="mx-auto max-w-[90%] sm:max-w-[632px] md:max-w-[800px] lg:max-w-[1056px] xl:max-w-[1222px]">
      <div className={`p-4 rounded-xl ${backgroundColor}`}>{children}</div>
    </div>
  ) : (
    <div className={`w-full ${backgroundColor}`}>
      <div className="mx-auto max-w-[90%] sm:max-w-[600px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1190px]">
        {children}
      </div>
    </div>
  );
}
