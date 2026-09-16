import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Thin wrapper over the shared `.btn` classes in globals.css so a React
// <Button> and a plain <button className="btn btn-primary"> look identical.
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default:     "btn-primary",
      secondary:   "btn-secondary",
      outline:     "btn-secondary",
      ghost:       "btn-ghost",
      destructive: "btn-danger",
      success:     "btn-success",
      link:        "h-auto px-0 text-primary underline-offset-4 hover:underline",
    },
    size: {
      default:   "",
      xs:        "btn-xs",
      sm:        "btn-sm",
      lg:        "btn-lg",
      icon:      "btn-icon",
      "icon-xs": "btn-icon btn-xs",
      "icon-sm": "btn-icon btn-sm",
      "icon-lg": "btn-icon btn-lg",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
