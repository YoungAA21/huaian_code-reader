import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

const service: AxiosInstance = axios.create({
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
})

// 请求拦截器
service.interceptors.request.use(
    (config) => {
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// 响应拦截器
service.interceptors.response.use(
    (response: AxiosResponse) => {
        return response.data
    },
    (error) => {
        return Promise.reject(error)
    }
)

export default service