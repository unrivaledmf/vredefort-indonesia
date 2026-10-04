import React, { useState, useEffect } from 'react';

export const LOGO_SRC = '/logo.svg';
export const LOGO_PNG_SRC = '/logo.png';

interface BrandLogoProps {
  size?: number;
  withText?: boolean;
  className?: string;
  subtext?: string;
  version?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  withText = false,
  className = '',
  subtext,
  version
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(() => Date.now());

  useEffect(() => {
    const handleLogoUpdate = () => {
      setCacheBuster(Date.now());
      setLoadFailed(false);
    };
    window.addEventListener('vredefort-logo-updated', handleLogoUpdate);
    return () => window.removeEventListener('vredefort-logo-updated', handleLogoUpdate);
  }, []);

  const logoUrl = `${LOGO_SRC}?v=${version || cacheBuster}`;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Tile badge container with crisp contrast on both light and dark backgrounds */}
      <div
        style={{ width: size, height: size }}
        className="relative shrink-0 flex items-center justify-center rounded-xl bg-white dark:bg-[#0c121e] border border-neutral-200/90 dark:border-white/10 shadow-xs overflow-hidden p-1 transition-colors"
      >
        {!loadFailed ? (
          <img
            src={logoUrl}
            alt="Logo PT Vredefort Indonesia"
            loading="eager"
            onError={() => setLoadFailed(true)}
            className="w-full h-full object-contain select-none"
          />
        ) : (
          /* High-fidelity fallback SVG if asset is temporarily unreachable */
          <svg
            viewBox="0 0 1000 1000"
            className="w-full h-full select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M 42 16 C 5 130 18 225 82 272 C 182 342 278 472 264 660 C 294 560 305 408 248 304 C 185 190 106 130 42 16 Z" fill="#43B02A" />
            <path d="M 58 260 C 132 320 200 424 178 572 C 196 520 205 448 186 384 C 158 280 98 240 58 260 Z" fill="#43B02A" />
            <path d="M 78 12 C 182 92 352 260 368 472 C 382 630 310 740 374 870 C 416 952 454 1000 488 996 C 536 990 562 944 522 890 C 440 780 434 630 444 480 C 452 380 380 230 260 140 C 170 70 110 30 78 12 Z" fill="#1E73BE" />
            <path d="M 922 0 C 850 40 730 95 684 110 C 654 120 570 190 514 290 C 444 420 450 580 500 660 C 560 756 642 730 672 650 C 686 610 680 530 634 440 C 590 350 630 250 710 170 C 780 100 870 40 922 0 Z" fill="#29A9E0" />
            <path d="M 514 290 C 470 380 460 520 504 650 C 540 750 646 740 672 650 C 630 655 570 620 550 530 C 530 440 546 350 586 280 C 560 280 534 285 514 290 Z" fill="#1E73BE" />
            <path d="M 374 870 C 340 750 400 650 426 580 C 410 650 370 740 386 850 C 402 950 460 1000 496 1000 C 546 1000 566 940 536 886 C 500 820 480 880 450 930 C 420 980 394 950 374 870 Z" fill="#1E73BE" />
            <path d="M 430 576 C 390 670 410 770 476 830 C 560 910 642 850 676 730 C 690 680 686 600 640 530 C 600 470 590 410 626 350 C 586 410 576 490 606 566 C 636 640 616 710 570 740 C 520 776 470 740 456 676 C 446 636 440 596 430 576 Z" fill="#F7941D" />
            <path d="M 432 576 C 450 640 480 720 540 766 C 606 810 660 760 676 660 C 686 600 660 520 620 460 C 570 386 610 280 690 200 C 630 270 606 370 650 450 C 690 520 706 610 680 690 C 650 780 576 820 500 786 C 456 760 426 670 432 576 Z" fill="#F7941D" />
            <path d="M 956 20 C 1002 120 972 216 906 270 C 806 356 706 500 606 938 C 656 830 736 630 816 500 C 892 380 942 270 936 150 C 930 90 946 46 956 20 Z" fill="#F7941D" />
            <path d="M 936 150 C 866 240 790 350 726 480 C 640 650 610 820 606 938 C 636 816 690 660 760 520 C 826 390 892 276 936 150 Z" fill="#F7941D" />
          </svg>
        )}
      </div>

      {withText && (
        <div className="truncate text-left leading-tight">
          <span className="font-bold text-sm tracking-tight text-neutral-900 dark:text-white block uppercase">
            VREDEFORT
          </span>
          <span className="text-[10px] tracking-wider text-neutral-500 dark:text-neutral-400 font-medium block">
            {subtext || 'INDONESIA · MINING'}
          </span>
        </div>
      )}
    </div>
  );
};
