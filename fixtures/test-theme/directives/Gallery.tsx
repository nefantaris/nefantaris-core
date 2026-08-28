import type { PropsWithChildren } from "react";

const Gallery = ({ children }: PropsWithChildren) => (
    <div
        data-directive="gallery"
        className="grid grid-cols-2 gap-3 [&_img]:aspect-3/2 [&_img]:w-full [&_img]:object-contain"
    >
        {children}
    </div>
);

export default Gallery;
