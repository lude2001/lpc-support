# 阶段3架构设计：重构主控制器

## 设计目标

将现有的540行FormattingVisitor重构为真正的指挥中心模式：
- **FormattingOrchestrator**: 主控制器 (~200行)
- **FormattingVisitor**: 纯访问者实现 (~100行)
- **FormattingStrategy**: 策略管理系统

## 核心组件设计

### 1. FormattingOrchestrator (主控制器)

```typescript
/**
 * 格式化编排器 - 系统的指挥中心
 * 负责协调所有格式化组件，不直接进行格式化操作
 */
export class FormattingOrchestrator {
    // 核心职责：
    // 1. 策略选择和管理
    // 2. 访问者路由协调
    // 3. 缓存策略控制
    // 4. 错误恢复机制
    // 5. 性能监控和优化
}
```

### 2. FormattingStrategyManager (策略管理器)

```typescript
/**
 * 格式化策略管理器
 * 支持可插拔的格式化策略
 */
export class FormattingStrategyManager {
    // 管理多种策略：
    // - CompactStrategy: 紧凑模式
    // - StandardStrategy: 标准模式  
    // - DebugStrategy: 调试模式
    // - CustomStrategy: 用户自定义
}
```

### 3. FormattingRouter (路由器)

```typescript
/**
 * 格式化路由器
 * 高效路由访问者到对应的格式化器
 */
export class FormattingRouter {
    // 路由机制：
    // - 基于节点类型的快速路由
    // - 策略条件路由
    // - 缓存感知路由
    // - 依赖关系管理
}
```

### 4. FormattingVisitor (纯访问者)

```typescript
/**
 * 简化的格式化访问者
 * 纯粹的访问者模式实现，不包含业务逻辑
 */
export class FormattingVisitor extends AbstractParseTreeVisitor<string> {
    // 职责简化为：
    // - 节点访问分派
    // - 上下文传递
    // - 基础错误处理
}
```

## 设计模式应用

### 1. 策略模式 (Strategy Pattern)
- 不同格式化场景使用不同策略
- 支持运行时策略切换
- 策略组合和继承

### 2. 观察者模式 (Observer Pattern)  
- 格式化事件通知机制
- 性能监控和统计
- 错误事件处理

### 3. 责任链模式 (Chain of Responsibility)
- 格式化器链式处理
- 错误恢复链
- 验证处理链

### 4. 工厂模式 (Factory Pattern)
- 格式化器工厂
- 策略工厂
- 上下文工厂

## 性能优化策略

### 1. 智能缓存系统
```typescript
// 多层缓存架构
interface CacheStrategy {
    nodeCache: Map<string, FormattingResult>;     // 节点级缓存
    strategyCache: Map<string, Strategy>;         // 策略缓存
    contextCache: Map<string, Context>;           // 上下文缓存
}
```

### 2. 访问者路由优化
```typescript
// 基于节点类型哈希的O(1)路由
interface RouterMap {
    [nodeType: string]: FormatterFactory;
}
```

### 3. 延迟加载机制
```typescript
// 按需加载格式化器
class LazyFormatterLoader {
    loadFormatter(type: FormatterType): Promise<IFormatter>;
}
```

## 扩展性设计

### 1. 插件化架构
```typescript
// 格式化器插件接口
interface IFormatterPlugin {
    readonly name: string;
    readonly version: string;
    readonly supportedNodes: string[];
    createFormatter(context: IFormattingContext): IFormatter;
}
```

### 2. 配置驱动
```typescript
// 分层配置系统
interface FormattingConfig {
    strategies: StrategyConfig[];
    formatters: FormatterConfig[];
    plugins: PluginConfig[];
    performance: PerformanceConfig;
}
```

### 3. 事件驱动
```typescript
// 事件系统支持扩展
interface FormattingEvents {
    onFormatStart: (context: IFormattingContext) => void;
    onFormatEnd: (result: FormattingResult) => void;
    onError: (error: FormattingError) => void;
}
```