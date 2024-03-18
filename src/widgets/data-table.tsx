import React from "react";
import { Box } from "@chakra-ui/react";
import DataTable from "../components/DataTable"; 

interface DataTableWidgetProps {
  caption?: string;
}

const DataTableWidget: React.FC<DataTableWidgetProps> = ({
  caption
}) => {
  // Sample data and columns
  const data = [
    { id: 1, name: "John Doe", age: 30, department: "IT" },
    { id: 2, name: "Jane Smith", age: 35, department: "HR" },
    { id: 3, name: "Bob Johnson", age: 40, department: "Finance" },
  ];

  const columns = ["id", "name", "age", "department"];

  return (
    <Box p={4}>
      <DataTable data={data} columns={columns} caption={caption}/>
    </Box>
  );
};

export default DataTableWidget;