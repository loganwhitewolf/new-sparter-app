export function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="min-h-32 bg-muted animate-pulse rounded-md" />
      ))}
      <div className="col-span-2 flex justify-center md:col-span-1 md:block">
        <div className="min-h-32 w-1/2 min-w-36 bg-muted animate-pulse rounded-md md:w-auto" />
      </div>
    </div>
  )
}
