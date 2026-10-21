export default function JobCardSkeleton() {
  return (
    <div className="job-item job-item-skeleton">
      <div className="row-between mb-12">
        <div className="sk-bar" style={{ width: 170, height: 12 }} />
        <div className="row gap-8">
          <div className="sk-bar" style={{ width: 34, height: 34, borderRadius: "50%" }} />
          <div className="sk-bar" style={{ width: 34, height: 34, borderRadius: "50%" }} />
        </div>
      </div>
      <div className="sk-bar mb-12" style={{ height: 22, width: "55%" }} />
      <div className="sk-bar sk-meta" />
      <div className="sk-bar sk-line mt-12" style={{ width: "100%" }} />
      <div className="sk-bar sk-line" style={{ width: "92%" }} />
      <div className="sk-bar sk-line" style={{ width: "70%" }} />
      <div className="row gap-8 mt-12">
        <div className="sk-bar sk-tag" />
        <div className="sk-bar sk-tag" />
        <div className="sk-bar sk-tag" />
      </div>
    </div>
  );
}
