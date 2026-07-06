# Web Delta Spec

## Modified Requirements

### Requirement: Login page copy reflects actual state

登录页必须展示面向已存在账户的登录说明，不得复用首次初始化说明文案。

#### Scenario: initialized instance renders login page

- Given 实例已经初始化且存在可登录用户
- When 用户打开 `/login`
- Then 页面显示登录说明文案
- And 页面不显示“创建第一个管理员账户”之类的初始化提示
