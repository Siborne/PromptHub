# Desktop Spec Delta

## Modified Requirements

### Rules Selection Stability

- Rules 视图中的当前选中规则必须在保存后保持稳定，不能因为异步刷新、慢读返回或默认重选逻辑自动跳到其他平台规则。
- 当用户在前一个规则读取尚未完成时切换到另一个规则，旧读取结果不得覆盖新规则的详情内容或草稿内容。
