export function DonutSkeleton() {
  return (
    <div className="flex items-center justify-around gap-6 py-2">
      <div className="w-36 h-36 rounded-full border-[14px] border-bg-3 animate-pulse shrink-0" />
      <div className="flex flex-col gap-4 min-w-[100px]">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-bg-3 animate-pulse" />
            <div className="h-3 w-20 bg-bg-3 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarSkeleton() {
  return (
    <div className="flex items-end justify-around gap-2 h-40 px-2 pt-4">
      {[60, 85, 45, 70, 90, 55, 75].map((h, i) => (
        <div key={i} className="flex-1 rounded-t animate-pulse bg-bg-3" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}