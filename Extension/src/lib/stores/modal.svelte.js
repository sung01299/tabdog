function createModalStore() {
  let active = $state(null);
  let props = $state({});

  return {
    get active() { return active; },
    get props() { return props; },

    open(modalName, modalProps = {}) {
      active = modalName;
      props = modalProps;
    },

    close() {
      active = null;
      props = {};
    },
  };
}

export const modalStore = createModalStore();
