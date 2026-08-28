export type SiteMeta = { name: string };

export type PageMeta = {
    title: string;
    description?: string;
    date?: string;
    slug?: string;
    draft?: boolean;
    template?: string;
    order?: number;
};

export type PostSummary = {
    route: string;
    title: string;
    description?: string;
    date: string;
};

export type ElementProps = Record<string, string | boolean>;

export type ContentNode =
    | { kind: "text"; value: string }
    | {
          kind: "element";
          tag: string;
          props: ElementProps;
          children: ContentNode[];
      }
    | { kind: "directive"; name: string; children: ContentNode[] };

export type RouteEntry = {
    path: string;
    template: string;
    meta: PageMeta;
    body: ContentNode[];
};
