// public/js/app.js
const { createApp, ref, reactive, onMounted } = Vue;

createApp({
    setup() {
        // 状态变量
        const statusInfo = ref({
            status: 'unknown',
            timestamp: '',
            uptime: 0,
            message: '系统未连接'
        });
        
        const devices = ref([]);
        const selectedDevice = ref('');
        const records = ref([]);
        const loading = ref(false);
        const summaryData = ref(null);
        const activeFilter = ref('all'); // 当前激活的筛选条件
        
        // 详情对话框相关
        const detailDialogVisible = ref(false);
        const testDetails = ref(null);
        
        // 搜索参数
        const searchParams = reactive({
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 默认一周前
            endDate: new Date()
        });
        
        // 分页信息
        const pagination = reactive({
            currentPage: 1,
            pageSize: 20,
            totalRecords: 0
        });

        // 格式化运行时间
        const formatUptime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            return `${hours}小时 ${minutes}分钟 ${secs}秒`;
        };

        // 获取系统状态
        const getStatus = async () => {
            try {
                const response = await axios.get('/api/status');
                statusInfo.value = response.data;
            } catch (error) {
                console.error('获取状态失败:', error);
                statusInfo.value = {
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    uptime: 0,
                    message: '无法连接到服务器'
                };
            }
        };

        // 获取设备列表
        const getDevices = async () => {
            try {
                const response = await axios.get('/api/devices');
                devices.value = response.data.data;
                if (devices.value.length > 0 && !selectedDevice.value) {
                    selectedDevice.value = devices.value[0];
                }
            } catch (error) {
                console.error('获取设备列表失败:', error);
            }
        };

        // 获取测试记录
        const fetchRecords = async () => {
            loading.value = true;
            try {
                const params = {
                    startDate: searchParams.startDate ? new Date(searchParams.startDate).toISOString() : undefined,
                    endDate: searchParams.endDate ? new Date(searchParams.endDate).toISOString() : undefined,
                    deviceName: selectedDevice.value || undefined,
                    result: activeFilter.value !== 'all' ? activeFilter.value : undefined, // 添加结果筛选参数
                    page: pagination.currentPage,
                    limit: pagination.pageSize
                };
                
                const response = await axios.get('/api/records', { params });
                records.value = response.data.data;
                pagination.totalRecords = response.data.pagination.totalRecords;
                
                // 同时更新统计摘要
                if (response.data.summary) {
                    summaryData.value = response.data.summary;
                }
            } catch (error) {
                console.error('获取记录失败:', error);
                ElMessage.error('获取记录失败: ' + error.message);
            } finally {
                loading.value = false;
            }
        };

        // 获取报表数据
        const fetchReport = async () => {
            loading.value = true;
            try {
                const params = {
                    startDate: searchParams.startDate ? new Date(searchParams.startDate).toISOString() : undefined,
                    endDate: searchParams.endDate ? new Date(searchParams.endDate).toISOString() : undefined,
                    deviceName: selectedDevice.value || undefined
                };
                
                const response = await axios.get('/api/report', { params });
                summaryData.value = response.data.data.summary;
                ElMessage.success('报表生成成功');
            } catch (error) {
                console.error('获取报表失败:', error);
                ElMessage.error('获取报表失败: ' + error.message);
            } finally {
                loading.value = false;
            }
        };

        // 导出Excel
        const exportExcel = async () => {
            try {
                const data = {
                    startDate: searchParams.startDate ? new Date(searchParams.startDate).toISOString() : undefined,
                    endDate: searchParams.endDate ? new Date(searchParams.endDate).toISOString() : undefined,
                    deviceName: selectedDevice.value || undefined
                };
                
                // 创建一个隐藏的iframe来下载文件
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/api/export-excel';
                form.style.display = 'none';
                
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'startDate';
                input.value = data.startDate || '';
                form.appendChild(input);
                
                const input2 = document.createElement('input');
                input2.type = 'hidden';
                input2.name = 'endDate';
                input2.value = data.endDate || '';
                form.appendChild(input2);
                
                const input3 = document.createElement('input');
                input3.type = 'hidden';
                input3.name = 'deviceName';
                input3.value = data.deviceName || '';
                form.appendChild(input3);
                
                document.body.appendChild(form);
                form.submit();
                document.body.removeChild(form);
                
                ElMessage.success('开始导出Excel，请稍候...');
            } catch (error) {
                console.error('导出Excel失败:', error);
                ElMessage.error('导出Excel失败: ' + error.message);
            }
        };

        // 刷新状态
        const refreshStatus = () => {
            getStatus();
            ElMessage.success('状态已刷新');
        };

        // 分页相关方法
        const handleSizeChange = (val) => {
            pagination.pageSize = val;
            pagination.currentPage = 1;
            fetchRecords();
        };

        const handleCurrentChange = (val) => {
            pagination.currentPage = val;
            fetchRecords();
        };

        // 显示测试详情
        const showTestDetails = async (record) => {
            try {
                const response = await axios.get('/api/test-details', { 
                    params: { recordId: record.id } 
                });
                
                if (response.data.success) {
                    // 组合基本信息和详情，确保属性名匹配
                    testDetails.value = {
                        deviceName: record.device_name,
                        startTime: record.start_time,
                        endTime: record.end_time,
                        result: record.result,
                        okCount: record.ok_count,
                        ngCount: record.ng_count,
                        details: response.data.details || []
                    };
                    detailDialogVisible.value = true;
                } else {
                    ElMessage.error('获取测试详情失败: ' + response.data.error);
                }
            } catch (error) {
                console.error('获取测试详情失败:', error);
                ElMessage.error('获取测试详情失败: ' + error.message);
            }
        };

        // 检查测量值是否在规格范围内
        const isValueInSpec = (detail) => {
            if (detail.measured_value === null || detail.measured_value === undefined) {
                return false;
            }
            return detail.measured_value >= detail.spec_min && detail.measured_value <= detail.spec_max;
        };
        
        // 根据结果筛选记录
        const filterByResult = (result) => {
            activeFilter.value = result;
            pagination.currentPage = 1; // 重置到第一页
            fetchRecords();
            
            // 显示筛选提示
            let filterText = '全部记录';
            if (result === 'OK') filterText = 'OK记录';
            else if (result === 'NG') filterText = 'NG记录';
            
            ElMessage.success(`已切换到: ${filterText}`);
        };

        // 页面加载时获取数据
        onMounted(async () => {
            await getStatus();
            await getDevices();
            await fetchRecords(); // 获取默认记录，同时会更新统计摘要
        });

        return {
            statusInfo,
            devices,
            selectedDevice,
            records,
            loading,
            summaryData,
            activeFilter,
            detailDialogVisible,
            testDetails,
            searchParams,
            pagination,
            formatUptime,
            getStatus,
            getDevices,
            fetchRecords,
            fetchReport,
            exportExcel,
            refreshStatus,
            handleSizeChange,
            handleCurrentChange,
            showTestDetails,
            isValueInSpec,
            filterByResult
        };
    }
}).use(ElementPlus).mount('#app');