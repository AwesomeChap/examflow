import { Link, type LinkProps } from "react-router-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonStyles";

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

/**
 * A react-router `Link` styled to look exactly like a `Button`. Use this for
 * navigation actions instead of wrapping a `<Button>` in a `<Link>`, which
 * nests a `<button>` inside an `<a>` — invalid HTML that confuses assistive
 * tech and keyboard interaction. This renders a single semantic link.
 */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props} />;
}
