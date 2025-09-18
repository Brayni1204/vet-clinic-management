export default function Loading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="w-64 bg-white shadow-lg"></div>
      <div className="flex-1">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
