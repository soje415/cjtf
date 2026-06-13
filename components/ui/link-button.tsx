import Link from 'next/link'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { buttonVariants } from './button'

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string
  className?: string
  children: React.ReactNode
  target?: string
  rel?: string
}

export function LinkButton({ href, variant, size, className, children, target, rel }: LinkButtonProps) {
  return (
    <Link href={href} target={target} rel={rel} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  )
}
