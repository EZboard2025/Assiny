import Image from 'next/image'

export default function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} relative`}>
      <Image
        src="/images/logo-preta.png"
        alt="Ramppy Logo"
        fill
        className="object-contain"
      />
    </div>
  )
}