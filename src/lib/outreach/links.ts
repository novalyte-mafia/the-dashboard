export const EXTERNAL_LINK_REL = "noopener noreferrer";
export const EXTERNAL_LINK_TARGET = "_blank" as const;

export function externalLinkProps(href: string) {
  return {
    href,
    target: EXTERNAL_LINK_TARGET,
    rel: EXTERNAL_LINK_REL,
  };
}
