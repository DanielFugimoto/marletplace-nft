import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/catalog/home-page'
import { nftListQuery } from '@/features/catalog/queries'
import { catalogSearchSchema, toListParams } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toListParams(search),
  // Start fetching during navigation; the component renders skeletons until data arrives.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(nftListQuery(deps))
  },
  component: HomePage,
})
