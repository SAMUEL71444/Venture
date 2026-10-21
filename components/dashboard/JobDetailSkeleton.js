import { SkeletonBar, SkeletonText } from "@/components/ui/Skeleton";

// Kerangka loading untuk isi drawer detail proyek, sebelum "fetch" (simulasi)
// selesai. Murni presentational, tidak tahu data aslinya seperti apa.
export default function JobDetailSkeleton() {
  return (
    <div className="row" style={{ flexDirection: "column", gap: 22, alignItems: "stretch" }}>
      <div className="row-between">
        <SkeletonBar width={90} height={22} radius={20} />
        <SkeletonBar width={70} height={16} />
      </div>
      <SkeletonBar width="80%" height={22} />
      <SkeletonBar width="45%" height={14} />

      <div className="row gap-16">
        <SkeletonBar width="30%" height={40} />
        <SkeletonBar width="30%" height={40} />
      </div>

      <div>
        <SkeletonBar width={110} height={13} className="mb-12" />
        <SkeletonText lines={4} />
      </div>

      <div>
        <SkeletonBar width={140} height={13} className="mb-12" />
        <SkeletonText lines={3} lastLineWidth="55%" />
      </div>
    </div>
  );
}
