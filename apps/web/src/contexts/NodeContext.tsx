import { createContext, useContext, useEffect, useState } from "react";

type NodeContextType = {
  nodeNames: {
    [key: string]: string[]; // 'ODIN' | 'HEIMDALL'
  };
};

const NodeContext = createContext<NodeContextType>({
  nodeNames: {},
});

export const NodeContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [nodeNames, setNodeNames] = useState<{
    [key: string]: string[]; // 'ODIN' | 'HEIMDALL'
  }>({});

  useEffect(() => {
    const fetchEndpoints = async () => {
      const response = await fetch(
        `${process.env.NEXT_API_URL}/transactions/endpoints`
      );
      const endpoints: string[][] = await response.json(); // [[ODIN 노드들], [HEIMDALL 노드들]]

      // 상태 업데이트
      setNodeNames({ ODIN: endpoints[0], HEIMDALL: endpoints[1] });
    };

    fetchEndpoints();
  }, []);

  return (
    <NodeContext.Provider value={{ nodeNames }}>
      {children}
    </NodeContext.Provider>
  );
};

export const useNodeContext = (): NodeContextType => {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error("useNodeContext must be used within a NodeContextProvider");
  }
  return context;
};
