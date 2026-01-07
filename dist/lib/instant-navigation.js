"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInstantNavigation = useInstantNavigation;
exports.usePrefetch = usePrefetch;
// Instant navigation with optimistic UI updates
const navigation_1 = require("next/navigation");
const react_1 = require("react");
function useInstantNavigation() {
    const router = (0, navigation_1.useRouter)();
    const [isPending, startTransition] = (0, react_1.useTransition)();
    const navigate = (href) => {
        startTransition(() => {
            router.push(href);
        });
    };
    return { navigate, isPending };
}
// Prefetch links on hover for instant navigation
function usePrefetch() {
    const router = (0, navigation_1.useRouter)();
    const prefetch = (href) => {
        router.prefetch(href);
    };
    return { prefetch };
}
