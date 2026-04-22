import { BookFastLoadingMark } from "@/components/brand/BookFastLoadingMark";

export default function TenantPublicLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#05070A]">
      <BookFastLoadingMark size={104} />
    </div>
  );
}
