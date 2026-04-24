export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 flex justify-center">
          <span className="text-2xl font-semibold tracking-tight">Sparter</span>
        </div>
        {children}
      </div>
    </div>
  )
}
