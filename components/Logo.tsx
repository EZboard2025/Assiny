export default function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} bg-primary rounded-lg flex items-center justify-center`}>
      <span className="text-white font-bold text-2xl">y.</span>
    </div>
  )
}