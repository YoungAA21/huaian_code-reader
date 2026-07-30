import { createRouter, createWebHistory } from 'vue-router'
import index from '../views/index.vue'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: index
    },
    {
        path: '/reader-trends',
        name: 'ReaderTrends',
        component: () => import('../views/ReaderTrends.vue')
    },
    {
        path: '/spare-parts',
        name: 'SpareParts',
        component: () => import('../views/SparePartManagement.vue')
    },
    // 如果以后有其他页面，可以继续添加
    // {
    //   path: '/about',
    //   name: 'About',
    //   component: () => import('../components/About.vue')
    // }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
