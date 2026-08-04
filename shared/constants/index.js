module.exports = {
  TOPICS: {
    USER: 'user-events',
    PRODUCT: 'product-events',
    ORDER: 'order-events'
  },
  EVENTS: {
    USER: {
      CREATED: 'USER_CREATED',
      UPDATED: 'USER_UPDATED',
      DELETED: 'USER_DELETED'
    },
    PRODUCT: {
      CREATED: 'PRODUCT_CREATED',
      UPDATED: 'PRODUCT_UPDATED',
      DELETED: 'PRODUCT_DELETED'
    },
    ORDER: {
      CREATED: 'ORDER_CREATED',
      UPDATED: 'ORDER_UPDATED',
      DELETED: 'ORDER_DELETED'
    }
  },
  DLQ_SUFFIX: '-dlq'
};
