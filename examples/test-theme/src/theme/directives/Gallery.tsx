import type { PropsWithChildren } from "react";

const Gallery = ({ children }: PropsWithChildren) => (
    <div data-directive="gallery" className="grid grid-cols-2 gap-3">
        {children}
    </div>
);

export default Gallery;
